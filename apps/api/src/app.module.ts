import { Module } from "@nestjs/common";
import { SendersModule } from "./senders/senders.module";
import { SettingsModule } from "./settings/settings.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./common/database.module";
import { OutlookModule } from "./outlook/outlook.module";

@Module({
  imports: [DatabaseModule, AuthModule, SendersModule, SettingsModule, HealthModule, OutlookModule],
})
export class AppModule {}
