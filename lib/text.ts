export const normalizeAnswer = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\u2018\u2019\u2032]/g, "'")
        .replace(/\s+/g, " ");

export const hashString = (value: string) => {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 33) ^ value.charCodeAt(index);
    }
    return hash >>> 0;
};

export const uniqueValues = (values: string[]) =>
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));