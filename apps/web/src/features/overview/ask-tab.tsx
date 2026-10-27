import { Sparkles } from "lucide-react";
import { PlaceholderNote } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

const EXAMPLES = ["Can I afford a $4,000 laptop this month?", "How much should I set aside for Q4 taxes?", "Which clients paid late this year?"];

export function AskTab() {
  return (
    <div className="space-y-4">
      <PlaceholderNote>Ask is not connected yet. No data leaves this page. AI features arrive in a later step and will follow your AI and privacy settings.</PlaceholderNote>
      <Card>
        <CardContent className="space-y-3 pt-4">
          <Textarea disabled rows={3} placeholder="Ask a question about your money" aria-label="Ask a question" />
          <div className="flex flex-wrap items-center gap-2">
            {EXAMPLES.map((e) => (
              <span key={e} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{e}</span>
            ))}
            <Button disabled className="ml-auto"><Sparkles /> Ask</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
