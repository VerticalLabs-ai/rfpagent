import { MLModelIntegration } from '../server/services/mlModelIntegration';

describe('MLModelIntegration - Multiple Linear Regression', () => {
  let mlService: MLModelIntegration;

  beforeAll(() => {
    mlService = MLModelIntegration.getInstance();
  });

  test('should compute valid regression coefficients with sufficient data', () => {
    // Simple test data: y = 10 + 2*x1 (single variable to simplify)
    const X = [
      [1],
      [2],
      [3],
      [4],
      [5],
    ];
    const y = [12, 14, 16, 18, 20]; // y = 10 + 2*x1

    // Access private method via type assertion for testing
    const multipleLinearRegression = (mlService as any).multipleLinearRegression.bind(mlService);
    const coefficients = multipleLinearRegression(X, y);

    expect(coefficients).not.toBeNull();
    expect(coefficients).toHaveLength(2); // intercept + 1 feature

    // Check coefficients are approximately correct (allowing for numerical precision)
    expect(coefficients![0]).toBeCloseTo(10, 1); // intercept
    expect(coefficients![1]).toBeCloseTo(2, 1); // coefficient for x1
  });

  test('should return null with insufficient data', () => {
    const X = [
      [1, 2],
      [2, 3],
    ];
    const y = [5, 8];

    const multipleLinearRegression = (mlService as any).multipleLinearRegression.bind(mlService);
    const coefficients = multipleLinearRegression(X, y);

    expect(coefficients).toBeNull();
  });

  test('should return null with invalid input dimensions', () => {
    const X = [[1, 2], [2, 3]];
    const y = [5]; // Mismatched dimensions

    const multipleLinearRegression = (mlService as any).multipleLinearRegression.bind(mlService);
    const coefficients = multipleLinearRegression(X, y);

    expect(coefficients).toBeNull();
  });

  test('should handle empty input gracefully', () => {
    const X: number[][] = [];
    const y: number[] = [];

    const multipleLinearRegression = (mlService as any).multipleLinearRegression.bind(mlService);
    const coefficients = multipleLinearRegression(X, y);

    expect(coefficients).toBeNull();
  });

  test('matrix operations should work correctly', () => {
    const transpose = (mlService as any).transpose.bind(mlService);
    const matrixMultiply = (mlService as any).matrixMultiply.bind(mlService);

    // Test transpose
    const matrix = [[1, 2, 3], [4, 5, 6]];
    const transposed = transpose(matrix);
    expect(transposed).toEqual([[1, 4], [2, 5], [3, 6]]);

    // Test matrix multiplication
    const A = [[1, 2], [3, 4]];
    const B = [[5, 6], [7, 8]];
    const product = matrixMultiply(A, B);
    expect(product).toEqual([[19, 22], [43, 50]]);
  });

  test('matrix inversion should work for simple 2x2 matrix', () => {
    const matrixInverse = (mlService as any).matrixInverse.bind(mlService);

    // Simple 2x2 matrix [[2, 1], [1, 2]]
    // Inverse should be [[2/3, -1/3], [-1/3, 2/3]]
    const matrix = [[2, 1], [1, 2]];
    const inverse = matrixInverse(matrix);

    expect(inverse).not.toBeNull();
    expect(inverse![0][0]).toBeCloseTo(2/3, 5);
    expect(inverse![0][1]).toBeCloseTo(-1/3, 5);
    expect(inverse![1][0]).toBeCloseTo(-1/3, 5);
    expect(inverse![1][1]).toBeCloseTo(2/3, 5);
  });

  test('matrix inversion should return null for singular matrix', () => {
    const matrixInverse = (mlService as any).matrixInverse.bind(mlService);

    // Singular matrix (determinant = 0)
    const singularMatrix = [[1, 2], [2, 4]];
    const inverse = matrixInverse(singularMatrix);

    expect(inverse).toBeNull();
  });

  test('predictValue should compute correct predictions', () => {
    const predictValue = (mlService as any).predictValue.bind(mlService);

    const features = [1, 2];
    const coefficients = [5, 3, 2]; // intercept=5, coeff1=3, coeff2=2

    // prediction = 5 + 3*1 + 2*2 = 5 + 3 + 4 = 12
    const prediction = predictValue(features, coefficients);
    expect(prediction).toBe(12);
  });
});
