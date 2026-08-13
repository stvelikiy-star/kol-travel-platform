import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";

export function updateClientProfileDemoAction(input: unknown): DemoActionResult {
  void input;

  // TODO: Validate authenticated client ownership before updating real profile rows later.
  return createDemoActionResult({
    action: "client.update_profile",
    message: "Demo client profile update accepted. Real profile updates will be connected after auth."
  });
}

export function updateClientAddressDemoAction(input: unknown): DemoActionResult {
  void input;

  // TODO: Validate authenticated client ownership before writing delivery addresses later.
  return createDemoActionResult({
    action: "client.update_address",
    message: "Demo client address update accepted. Real address storage will be connected after auth."
  });
}
