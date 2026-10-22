import { Module } from '@nestjs/common';
import { ExtinguishersController } from './extinguishers.controller';

@Module({ controllers: [ExtinguishersController] })
export class ExtinguishersModule {}
