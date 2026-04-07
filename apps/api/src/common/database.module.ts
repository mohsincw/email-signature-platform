import { Global, Module } from "@nestjs/common";
import { PrismaClient } from "@esp/database";

const prismaProvider = {
  provide: PrismaClient,
  useFactory: () => {
    const client = new PrismaClient();
    client.$connect();
    return client;
  },
};

@Global()
@Module({
  providers: [prismaProvider],
  exports: [PrismaClient],
})
export class DatabaseModule {}
