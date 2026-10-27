import Link from "next/link";
import { PRODUCT_NAME } from "@repo/core/config";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Shown in place of Clerk when no Clerk keys are configured. */
export function DemoAuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <Card className="w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold">{mode === "sign-in" ? `Sign in to ${PRODUCT_NAME}` : `Create your ${PRODUCT_NAME} account`}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Demo mode: sign-in is off because Clerk keys are not set. Add them to <code className="font-mono text-xs">.env.local</code> to enable it.
      </p>
      <Button asChild className="mt-5 w-full">
        <Link href={mode === "sign-in" ? "/app/overview" : "/onboarding/1"}>Continue with sample data</Link>
      </Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {mode === "sign-in" ? (
          <>New here? <Link className="text-primary hover:underline" href="/signup">Create an account</Link></>
        ) : (
          <>Have an account? <Link className="text-primary hover:underline" href="/login">Sign in</Link></>
        )}
      </p>
    </Card>
  );
}
