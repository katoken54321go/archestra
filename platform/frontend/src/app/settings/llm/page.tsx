"use client";

import { archestraApiSdk, type archestraApiTypes } from "@shared";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalDocsLink } from "@/components/external-docs-link";
import { LlmModelSearchableSelect } from "@/components/llm-model-select";
import { WithPermissions } from "@/components/roles/with-permissions";
import {
  SettingsBlock,
  SettingsSaveBar,
  SettingsSectionStack,
} from "@/components/settings/settings-block";
import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFrontendDocsUrl } from "@/lib/docs/docs";
import { useModelsWithApiKeys } from "@/lib/llm-models.query";
import {
  useOrganization,
  useUpdateLlmSettings,
} from "@/lib/organization.query";
import { useTeams } from "@/lib/teams/team.query";

type LimitCleanupInterval = NonNullable<
  NonNullable<
    archestraApiTypes.UpdateLlmSettingsData["body"]
  >["limitCleanupInterval"]
>;

const CLEANUP_INTERVAL_LABELS: Record<LimitCleanupInterval, string> = {
  "1h": "Every hour",
  "12h": "Every 12 hours",
  "24h": "Every 24 hours",
  "1w": "Every week",
  "1m": "Every month",
};

type CompressionScope = NonNullable<
  NonNullable<
    archestraApiTypes.UpdateLlmSettingsData["body"]
  >["compressionScope"]
>;
type CompressionMode = "disabled" | CompressionScope;

const COMPRESSION_MODE_LABELS: Record<CompressionMode, string> = {
  disabled: "Disabled",
  organization: "Organization level",
  team: "Team level",
};

export default function LlmSettingsPage() {
  const { data: organization, isPending: isOrganizationPending } =
    useOrganization();
  const { data: teams, isPending: areTeamsPending } = useTeams();
  const { data: modelsWithApiKeys = [] } = useModelsWithApiKeys();
  const queryClient = useQueryClient();
  const organizationWithDefaultUserLimit = organization as
    | (NonNullable<typeof organization> & {
        defaultUserLimitValue?: number | null;
        defaultUserLimitModel?: string[] | null;
      })
    | undefined;

  const [compressionMode, setCompressionMode] =
    useState<CompressionMode>("disabled");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [cleanupInterval, setCleanupInterval] =
    useState<LimitCleanupInterval>("1h");
  const [defaultUserLimitValue, setDefaultUserLimitValue] = useState("");
  const [defaultUserLimitModels, setDefaultUserLimitModels] = useState<
    string[]
  >([]);
  const [defaultUserModelToAdd, setDefaultUserModelToAdd] = useState("");
  const toonDocsUrl = getFrontendDocsUrl(
    "platform-costs-and-limits",
    "toon-compression",
  );

  const modelOptions = modelsWithApiKeys.map((model) => ({
    value: model.modelId,
    model: model.modelId,
    provider: model.provider,
    pricePerMillionInput: model.pricePerMillionInput ?? "0",
    pricePerMillionOutput: model.pricePerMillionOutput ?? "0",
  }));

  const updateLlmSettingsMutation = useUpdateLlmSettings(
    "LLM settings updated",
    "Failed to update LLM settings",
  );

  // Sync state when both organization and teams data are loaded
  useEffect(() => {
    if (!organization || !teams) return;
    if (organization.compressionScope === "organization") {
      setCompressionMode(
        organization.convertToolResultsToToon ? "organization" : "disabled",
      );
    } else {
      // Fall back to "disabled" if scope is "team" but no teams exist
      setCompressionMode(teams.length > 0 ? "team" : "disabled");
    }
    setCleanupInterval(
      (organization.limitCleanupInterval as LimitCleanupInterval) || "1h",
    );
    const defaultLimitOrganization = organization as typeof organization & {
      defaultUserLimitValue?: number | null;
      defaultUserLimitModel?: string[] | null;
    };
    setDefaultUserLimitValue(
      defaultLimitOrganization.defaultUserLimitValue?.toString() ?? "",
    );
    setDefaultUserLimitModels(
      defaultLimitOrganization.defaultUserLimitModel ?? [],
    );
    const enabledTeams = teams
      .filter((team) => team.convertToolResultsToToon)
      .map((team) => team.id);
    setSelectedTeamIds(enabledTeams);
  }, [organization, teams]);

  const loadedTeams = teams ?? [];

  // Determine if anything has changed from server state
  const serverCompressionMode: CompressionMode =
    organization?.compressionScope === "organization"
      ? organization?.convertToolResultsToToon
        ? "organization"
        : "disabled"
      : loadedTeams.length > 0
        ? "team"
        : "disabled";

  const serverCleanupInterval =
    (organization?.limitCleanupInterval as LimitCleanupInterval) || "1h";
  const serverDefaultUserLimitValue =
    organizationWithDefaultUserLimit?.defaultUserLimitValue?.toString() ?? "";
  const serverDefaultUserLimitModels =
    organizationWithDefaultUserLimit?.defaultUserLimitModel ?? [];

  const serverTeamIds = loadedTeams
    .filter((team) => team.convertToolResultsToToon)
    .map((team) => team.id)
    .sort();

  const hasCompressionChanges =
    compressionMode !== serverCompressionMode ||
    (compressionMode === "team" &&
      JSON.stringify([...selectedTeamIds].sort()) !==
        JSON.stringify(serverTeamIds));

  const hasCleanupChanges = cleanupInterval !== serverCleanupInterval;
  const hasDefaultUserLimitChanges =
    defaultUserLimitValue !== serverDefaultUserLimitValue ||
    JSON.stringify([...defaultUserLimitModels].sort()) !==
      JSON.stringify([...serverDefaultUserLimitModels].sort());

  const isInitialLoading = isOrganizationPending || areTeamsPending;
  const hasChanges =
    !isInitialLoading &&
    (hasCompressionChanges ||
      hasCleanupChanges ||
      hasDefaultUserLimitChanges);

  const handleSave = async () => {
    const mutations: Promise<unknown>[] = [];

    // Collect compression settings mutation
    if (hasCompressionChanges) {
      if (compressionMode === "disabled") {
        mutations.push(
          updateLlmSettingsMutation.mutateAsync({
            compressionScope: "organization",
            convertToolResultsToToon: false,
          }),
        );
      } else if (compressionMode === "organization") {
        mutations.push(
          updateLlmSettingsMutation.mutateAsync({
            compressionScope: "organization",
            convertToolResultsToToon: true,
          }),
        );
      } else {
        mutations.push(
          updateLlmSettingsMutation
            .mutateAsync({
              compressionScope: "team",
              convertToolResultsToToon: false,
            })
            .then(() =>
              Promise.all(
                loadedTeams.map((team) =>
                  archestraApiSdk.updateTeam({
                    path: { id: team.id },
                    body: {
                      name: team.name,
                      description: team.description ?? undefined,
                      convertToolResultsToToon: selectedTeamIds.includes(
                        team.id,
                      ),
                    },
                  }),
                ),
              ),
            )
            .then(() => queryClient.invalidateQueries({ queryKey: ["teams"] })),
        );
      }
    }

    const limitSettingsUpdate: Partial<
      archestraApiTypes.UpdateLlmSettingsData["body"]
    > = {};
    if (hasCleanupChanges) {
      limitSettingsUpdate.limitCleanupInterval = cleanupInterval;
    }

    if (hasDefaultUserLimitChanges) {
      const normalizedValue = defaultUserLimitValue
        ? Number(defaultUserLimitValue)
        : null;
      if (normalizedValue && defaultUserLimitModels.length === 0) {
        toast.error("Select at least one model for the default user limit.");
        return;
      }
      limitSettingsUpdate.defaultUserLimitValue = normalizedValue;
      limitSettingsUpdate.defaultUserLimitModel = normalizedValue
        ? defaultUserLimitModels
        : null;
    }

    if (Object.keys(limitSettingsUpdate).length > 0) {
      mutations.push(updateLlmSettingsMutation.mutateAsync(limitSettingsUpdate));
    }

    const results = await Promise.allSettled(mutations);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0 && failures.length < results.length) {
      toast.error("Some settings failed to save. Please try again.");
    } else if (failures.length === results.length && failures.length > 0) {
      toast.error("Failed to save settings.");
    }
  };

  const handleCancel = () => {
    setCompressionMode(serverCompressionMode);
    setCleanupInterval(serverCleanupInterval);
    setDefaultUserLimitValue(serverDefaultUserLimitValue);
    setDefaultUserLimitModels(serverDefaultUserLimitModels);
    setDefaultUserModelToAdd("");
    setSelectedTeamIds(
      loadedTeams
        .filter((team) => team.convertToolResultsToToon)
        .map((team) => team.id),
    );
  };

  return (
    <SettingsSectionStack>
      <SettingsBlock
        title="Apply compression to tool results"
        description={
          <>
            Reduce LLM token usage up to 60% by using TOON (Token-Oriented
            Object Notation) compression for tool results.
            {toonDocsUrl && (
              <>
                {" "}
                <ExternalDocsLink
                  href={toonDocsUrl}
                  className="text-inherit underline underline-offset-4"
                  showIcon={false}
                >
                  Learn how TOON compression works
                </ExternalDocsLink>
                .
              </>
            )}
          </>
        }
        control={
          <WithPermissions
            permissions={{ llmSettings: ["update"] }}
            noPermissionHandle="tooltip"
          >
            {({ hasPermission }) => (
              <Select
                value={compressionMode}
                onValueChange={(value: CompressionMode) =>
                  setCompressionMode(value)
                }
                disabled={
                  updateLlmSettingsMutation.isPending || !hasPermission
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPRESSION_MODE_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          </WithPermissions>
        }
      >
        {compressionMode === "team" && (
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Select teams</CardTitle>
            {loadedTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground w-48">
                No teams available
              </p>
            ) : (
              <div className="w-48">
                <MultiSelect
                  value={selectedTeamIds}
                  onValueChange={setSelectedTeamIds}
                  placeholder="Select teams..."
                  items={loadedTeams.map((team) => ({
                    value: team.id,
                    label: team.name,
                  }))}
                  disabled={updateLlmSettingsMutation.isPending}
                />
              </div>
            )}
          </div>
        )}
      </SettingsBlock>
      <SettingsBlock
        title="Default limit cleanup interval"
        description="Pre-selected when admins create new limits; each limit can override it."
        control={
          <WithPermissions
            permissions={{ llmSettings: ["update"] }}
            noPermissionHandle="tooltip"
          >
            {({ hasPermission }) => (
              <Select
                value={cleanupInterval}
                onValueChange={(value: LimitCleanupInterval) =>
                  setCleanupInterval(value)
                }
                disabled={
                  updateLlmSettingsMutation.isPending || !hasPermission
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLEANUP_INTERVAL_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          </WithPermissions>
        }
      />
      <SettingsBlock
        title="Default user limit ($)"
        description="Creates or updates per-user token-cost limits for all current and future members."
        control={
          <WithPermissions
            permissions={{ llmSettings: ["update"] }}
            noPermissionHandle="tooltip"
          >
            {({ hasPermission }) => (
              <Input
                value={defaultUserLimitValue}
                onChange={(event) =>
                  setDefaultUserLimitValue(
                    event.target.value.replace(/[^0-9]/g, ""),
                  )
                }
                placeholder="No limit"
                inputMode="numeric"
                className="w-48"
                disabled={
                  updateLlmSettingsMutation.isPending || !hasPermission
                }
              />
            )}
          </WithPermissions>
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">Models</CardTitle>
            <p className="text-sm text-muted-foreground">
              Leave the value empty to disable the default user limit.
            </p>
          </div>
          <div className="w-48 space-y-2">
            <LlmModelSearchableSelect
              value={defaultUserModelToAdd}
              onValueChange={(value) => {
                setDefaultUserModelToAdd("");
                setDefaultUserLimitModels((current) =>
                  current.includes(value) ? current : [...current, value],
                );
              }}
              options={modelOptions}
              placeholder="Select model..."
              showPricing={false}
              className="w-full"
              disabled={updateLlmSettingsMutation.isPending}
            />
            <div className="flex flex-wrap gap-1">
              {defaultUserLimitModels.map((model) => (
                <Badge key={model} variant="secondary" className="gap-1 pr-1">
                  {model}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() =>
                      setDefaultUserLimitModels((current) =>
                        current.filter(
                          (currentModel) => currentModel !== model,
                        ),
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </SettingsBlock>
      <SettingsSaveBar
        hasChanges={hasChanges}
        isSaving={updateLlmSettingsMutation.isPending}
        permissions={{ llmSettings: ["update"] }}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </SettingsSectionStack>
  );
}
