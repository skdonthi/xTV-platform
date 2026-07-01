// BUILD-TIME ONLY. Maps head-end provisioning identifiers to a tenant slug.
// Lives in build tooling and is NEVER bundled into an app artifact, so rival
// brand names never ship inside another cruiseline's signed package (GDPR).
const customerAliases = {
  AIDA: "aida",
  CCL: "ccl",
  CARNIVAL: "ccl",
  DEMO_HOTEL: "demo-hotel",
};

export function resolveCustomerSlug(input) {
  const value = input ?? "demo-hotel";
  return customerAliases[value] ?? value.toLowerCase();
}
