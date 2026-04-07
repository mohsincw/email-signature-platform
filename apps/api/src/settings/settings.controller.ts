import { Controller, Get, Put, Body } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import type { GlobalSettingsDto } from "@esp/shared-types";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.get();
  }

  @Put()
  update(@Body() dto: GlobalSettingsDto) {
    return this.settingsService.update(dto);
  }
}
