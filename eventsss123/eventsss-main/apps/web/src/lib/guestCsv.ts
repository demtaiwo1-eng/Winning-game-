export type GuestImportRow = {
  name: string;
  email?: string;
  phone?: string;
  plusOnes?: number;
};

function parseRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseGuestCsv(source: string): GuestImportRow[] {
  const rows = parseRows(source.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must include a header and at least one guest.");
  const headers = rows[0].map((value) => value.trim().toLowerCase().replace(/[ _-]+/g, ""));
  const nameIndex = headers.indexOf("name") >= 0 ? headers.indexOf("name") : headers.indexOf("fullname");
  if (nameIndex < 0) throw new Error("CSV needs a Name column.");
  const emailIndex = headers.indexOf("email");
  const phoneIndex = headers.indexOf("phone");
  const plusIndex = headers.indexOf("plusones");
  const guests = rows.slice(1).map((values, index) => {
    const get = (column: number) => column < 0 ? "" : (values[column] ?? "").trim();
    const name = get(nameIndex);
    const email = get(emailIndex);
    const phone = get(phoneIndex);
    const plusRaw = get(plusIndex);
    if (!name || name.length > 120) throw new Error("Row " + (index + 2) + ": name is required and must be 120 characters or fewer.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Row " + (index + 2) + ": email is invalid.");
    if (phone && (phone.length < 7 || phone.length > 20)) throw new Error("Row " + (index + 2) + ": phone must be 7–20 characters.");
    const plusOnes = plusRaw ? Number(plusRaw) : undefined;
    if (plusRaw && (!Number.isInteger(plusOnes) || plusOnes! < 0 || plusOnes! > 10)) {
      throw new Error("Row " + (index + 2) + ": plusOnes must be an integer from 0 to 10.");
    }
    return { name, ...(email ? { email } : {}), ...(phone ? { phone } : {}), ...(plusOnes !== undefined ? { plusOnes } : {}) };
  });
  if (guests.length > 500) throw new Error("Import is limited to 500 guests per file.");
  return guests;
}

function safeCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\- \t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function buildGuestCsv(
  guests: Array<{ name: string; email?: string | null; phone?: string | null; rsvp: string; plusOnes?: number; token?: string }>,
  origin: string,
): string {
  const rows = [
    ["Name", "Email", "Phone", "RSVP", "Plus ones", "Invitation URL"],
    ...guests.map((guest) => [
      guest.name,
      guest.email ?? "",
      guest.phone ?? "",
      guest.rsvp,
      guest.plusOnes ?? 0,
      guest.token ? origin.replace(/\/$/, "") + "/rsvp/" + guest.token : "",
    ]),
  ];
  return rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
}
