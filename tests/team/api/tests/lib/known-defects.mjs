// Cases where the baseline does not do what our specification expects. Each is a reported defect (D) or
// endpoint weakness (W), filed as a GitHub issue (number in brackets; docs/section-2-7-defects.md). The test still runs and still
// asserts the EXPECTED behaviour. It is reported as "todo" (known failure) instead of failing the suite, so CI
// stays meaningful for every other case. If a known-defect case starts passing (for example after a fix),
// node:test reports it, and its entry is removed here in the same pull request.
const D = {
  D1: 'D1 (#6): a rejected request can still be approved',
  D2: 'D2 (#7): empty or whitespace-only title accepted',
  D3: 'D3 (#8): PATCH replaces fields that were not sent',
  D4: 'D4 (#9): a rejected request can be rejected again (reason overwritten)',
  D5: 'D5 (#10): a rejected request can still be edited',
  D6: 'D6 (#11): two approvals at the same moment can create two work orders for one request (intermittent race)',
  W1: 'W1 (#12): title over 255 characters gives 500 (database error) instead of 400',
  W2: 'W2 (#13): description over 10000 characters accepted (spec maxLength not enforced)',
  W3: 'W3 (#14): JSON number accepted where a string is required',
  W4: 'W4 (#15): unknown enum value gives 500 instead of 400',
  W5: 'W5 (#16): id 0 or negative gives 404 instead of 400',
  W6: 'W6 (#17): non-numeric or decimal id gives 500 instead of 400',
  W7: 'W7 (#18): request id missing from the path gives 500 instead of 404',
  W8: 'W8 (#19): reason parameter missing gives 500 instead of 400',
};

const map = {};
const add = (defect, ...keys) => keys.forEach((k) => { map[k] = D[defect]; });
for (const op of ['createRequest', 'editRequest']) {
  add('D2', `${op}|body.title.03`, `${op}|body.title.04`);
  add('W1', `${op}|body.title.09`);
  add('W2', `${op}|body.description.06`);
  add('W3', `${op}|body.title.02`, `${op}|body.description.02`);
  add('W4', `${op}|body.priority.05`, `${op}|body.priority.06`, `${op}|body.priority.07`);
}
add('W4', 'approveRequest|body.assetStatus.08', 'approveRequest|body.assetStatus.09', 'approveRequest|body.assetStatus.10');
for (const op of ['getRequest', 'editRequest', 'approveRequest', 'rejectRequest']) {
  add('W5', `${op}|path.id.01`, `${op}|path.id.04`);
  add('W6', `${op}|path.id.05`, `${op}|path.id.06`);
}
add('W7', 'approveRequest|path.id.07', 'rejectRequest|path.id.07');
add('W8', 'rejectRequest|query.reason.06');
// Rule and state scenarios (rules-state.test.mjs)
// D1 (#6) fixed by the 'fix D1' pull request: API-ST-07 must now pass.
add('D4', 'state|Rejected -> reject again');
add('D5', 'state|Rejected -> edit');
add('D3', 'rule|PATCH keeps fields that were not sent');
add('D6', 'race|concurrent approvals');

export const KNOWN_DEFECTS = map;
export const DEFECTS = D;
export function defectFor(key) {
  return map[key];
}
