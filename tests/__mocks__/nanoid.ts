let counter = 0;
export const nanoid = (size?: number) => {
  counter++;
  return `mock-id-${counter}`;
};
