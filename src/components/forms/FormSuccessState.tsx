import { CheckCircleIcon } from "@/components/icons";

export function FormSuccessState({ message, title = "Kaydedildi" }: { message: string; title?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <CheckCircleIcon size={40} className="text-success" />
      <p className="text-lg font-bold text-text-primary">{title}</p>
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}
