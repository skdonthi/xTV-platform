// BUILD-TIME ONLY. Maps head-end provisioning identifiers to a tenant slug.
// Lives in build tooling and is NEVER bundled into an app artifact, so rival
// brand names never ship inside another cruiseline's signed package (GDPR).
//
// One entry per cruiseline. CCL is the current production tenant; add AIDA,
// RCCL, Disney etc. here as they onboard.
const customerAliases = {
  CCL: "ccl",
  CARNIVAL: "ccl",
};

export function resolveCustomerSlug(input) {
  const value = input ?? "ccl";
  return customerAliases[value] ?? value.toLowerCase();
}
