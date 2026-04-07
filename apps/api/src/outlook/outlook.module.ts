import { Module } from "@nestjs/common";
import { OutlookController } from "./outlook.controller";
import { OutlookService } from "./outlook.service";
import { graphClientProvider } from "./graph-client.provider";

@Module({
  controllers: [OutlookController],
  providers: [OutlookService, graphClientProvider],
  exports: [OutlookService],
})
export class OutlookModule {}
