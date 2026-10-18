/**
 * Firestore document ids cannot contain "/" (or be "." / ".." / "__x__"). Ids
 * come straight from URLs and request bodies, so an id such as "a/b" used to
 * reach the SDK and surface as a 500. Reject them up front as "not found".
 */
export function isUnsafeDocId(value: string) {
  return (
    value.includes("/") ||
    value === "." ||
    value === ".." ||
    /^__.*__$/.test(value) ||
    /[\u0000-\u001f]/.test(value) ||
    value.length > 700
  );
}
