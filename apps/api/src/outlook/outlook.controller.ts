import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
} from "@nestjs/common";
import { OutlookService } from "./outlook.service";

@Controller("outlook")
export class OutlookController {
  constructor(private readonly outlookService: OutlookService) {}

  @Get("status")
  getStatus() {
    return this.outlookService.getConfigStatus();
  }

  @Post("deploy")
  async deploy(
    @Body() body: { senderIds: string[] },
    @Req() req: any
  ) {
    const adminUserId = req.user?.sub;
    if (body.senderIds.length === 1) {
      const result = await this.outlookService.deploySignature(
        body.senderIds[0],
        adminUserId
      );
      return [result];
    }
    return this.outlookService.deployBulk(body.senderIds, adminUserId);
  }

  @Get("history/:senderId")
  getHistory(@Param("senderId") senderId: string) {
    return this.outlookService.getDeploymentHistory(senderId);
  }
}
