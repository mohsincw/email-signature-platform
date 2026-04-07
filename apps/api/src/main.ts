import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.ADMIN_ORIGIN ?? ["http://localhost:3000", "http://localhost:3002"] });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap();
