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
    [...value].some((ch) => ch.charCodeAt(0) < 32) ||
    value.length > 700
  );
}
