export const saveJsonFile = async (
  path: string,
  data: unknown,
): Promise<void> => {
  await Deno.mkdir("data", { recursive: true }).catch(() => {});
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2))
    .catch((error) => console.error(`Save error ${path}:`, error));
};

export const loadJsonFile = async <T>(
  path: string,
  defaultValue: T,
): Promise<T> => {
  try {
    const content = await Deno.readTextFile(path);
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
};
