export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_HELPER = "At least 8 characters, including a special character.";
export const PASSWORD_SPECIAL_CHARACTER_REGEX = /[^A-Za-z\d]/;

export type PasswordCheck = {
  ok: boolean;
  length: boolean;
  symbol: boolean;
};

export function checkPassword(password: string): PasswordCheck {
  const length = password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
  const symbol = PASSWORD_SPECIAL_CHARACTER_REGEX.test(password);
  return { ok: length && symbol, length, symbol };
}
