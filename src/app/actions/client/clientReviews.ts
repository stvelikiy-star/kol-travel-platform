import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function createReviewDemoAction(input: unknown): DemoActionResult {
  void input;

  // TODO: Validate client ownership of related order/booking and send sensitive reviews to moderation later.
  return createDemoActionResult({
    action: "client.create_review",
    message: "Demo review created. Real reviews may require moderation before publishing.",
    auditRequired: false
  });
}

export function updateReviewDemoAction(reviewId: string, input: unknown): DemoActionResult {
  void reviewId;
  void input;

  // TODO: Validate review ownership and moderation rules before updating real reviews later.
  return createDemoActionResult({
    action: "client.update_review",
    message: "Demo review update accepted. Real review edits will be connected later.",
    auditRequired: false
  });
}
