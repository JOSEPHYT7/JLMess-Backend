// Stub redis utility — no-op, zero dependencies.
// Redis has been removed. All functions are safe no-ops.

const getCache = async () => null;
const setCache = async () => {};
const deleteCache = async () => {};

module.exports = { getCache, setCache, deleteCache };
