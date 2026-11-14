export type GuardTask = {
  label: string;
  isDirty: () => boolean;
  save?: () => Promise<void>;
  discard: () => void | Promise<void>;
};
// Re-evaluate after every save: committing an editor can dirty its parent draft.
export async function settleNavigationGuards(
  getGuards: () => GuardTask[],
  mode: "save" | "discard",
) {
  for (let round = 0; round < 30; round++) {
    const guard = getGuards().find((g) => g.isDirty());
    if (!guard) return;
    if (mode === "save") {
      if (!guard.save)
        throw Error(`Finish or discard ${guard.label} before continuing`);
      await guard.save();
    } else await guard.discard();
  }
  if (getGuards().some((g) => g.isDirty()))
    throw Error("Changes are still pending. Stay here and finish saving.");
}
