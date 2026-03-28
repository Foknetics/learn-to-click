import { Module } from '@nestjs/common';
import { RoomModule } from './room/room.module.js';

@Module({
  imports: [RoomModule],
})
export class AppModule {}
