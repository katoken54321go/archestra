import { isNull } from "drizzle-orm";

type SoftDeletableTable = {
  deletedAt: Parameters<typeof isNull>[0];
};

export function notDeleted(table: SoftDeletableTable) {
  return isNull(table.deletedAt);
}

export function softDeleteValues() {
  return { deletedAt: new Date() };
}
