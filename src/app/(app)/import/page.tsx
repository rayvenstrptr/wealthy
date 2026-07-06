import { ImportWizard } from "@/components/import/import-wizard";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Import</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Bring in expenses and income from an .xlsx sheet with columns{" "}
          <span className="font-medium text-foreground">
            Cat · Details · Date · Ex · In · Type · Notes
          </span>
          . Formula cells keep the final amount; the calculation is saved into the notes.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
