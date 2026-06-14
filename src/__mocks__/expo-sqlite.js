// Mock para expo-sqlite — evita errores de módulo nativo en tests
const mockDb = {
  execAsync: jest.fn().mockResolvedValue(),
  runAsync: jest.fn().mockResolvedValue(),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn().mockImplementation(async (fn) => {
    await fn();
  }),
};

const mockSQLiteProvider = ({ children }) => children;

export const SQLiteProvider = mockSQLiteProvider;
export const useSQLiteContext = jest.fn().mockReturnValue(mockDb);

export default {
  SQLiteProvider,
  useSQLiteContext,
};
