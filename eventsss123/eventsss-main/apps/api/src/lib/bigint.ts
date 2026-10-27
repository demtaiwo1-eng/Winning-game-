// Safety net: BigInt (money) serializes as a string in any JSON response.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};
export {};
