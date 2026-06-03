import { Card } from "@/components/ui/card";

interface EmptySectionProps {
  title: string;
  description?: string;
}

export function EmptySection({
  title,
  description = "Раздел в разработке",
}: EmptySectionProps) {
  return (
    <Card style={{ minHeight: 320 }}>
      <h1 className="section-empty-title">{title}</h1>
      <p className="section-empty-text">{description}</p>
    </Card>
  );
}
