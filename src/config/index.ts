import dotenv from "dotenv";

dotenv.config();
interface JwtConfig {
  secret: string;
  refreshSecret: string;
}

interface Config {
  jwt: JwtConfig;
}

function validateEnvironmentVariables() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not defined.");
  }

  if (!process.env.REFRESH_JWT_SECRET) {
    throw new Error("REFRESH_JWT_SECRET environment variable is not defined.");
  }
}

validateEnvironmentVariables();

const config: Config = {
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.REFRESH_JWT_SECRET!,
  },
};

export default config;


