import { ValidationError } from '../domain/model.js';

export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let record: string[] = [],
    field = '',
    quoted = false,
    endedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        endedQuote = true;
      } else field += char;
    } else if (char === '"' && field === '' && !endedQuote) quoted = true;
    else if (char === ',' || char === '\n' || char === '\r') {
      record.push(field);
      field = '';
      endedQuote = false;
      if (char !== ',') {
        if (record.some((value) => value.trim())) records.push(record);
        record = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else {
      if (endedQuote || char === '"')
        throw new ValidationError('Malformed CSV quoting.');
      field += char;
    }
  }
  if (quoted)
    throw new ValidationError('CSV contains an unclosed quoted field.');
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  const headers =
    records.shift()?.map((header) => header.replace(/^\uFEFF/, '').trim()) ??
    [];
  if (!headers.length) throw new ValidationError('CSV is empty.');
  if (
    new Set(headers.map((header) => header.toLowerCase())).size !==
    headers.length
  )
    throw new ValidationError('CSV has duplicate column names.');
  return records.map((values, index) => {
    if (values.length !== headers.length)
      throw new ValidationError(
        `Row ${index + 2}: column count does not match the header.`,
      );
    return Object.fromEntries(
      headers.map((header, column) => [header, values[column]!]),
    );
  });
}
