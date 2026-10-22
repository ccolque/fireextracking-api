import { Module } from '@nestjs/common';
import { ExtinguisherTypesController } from './extinguisher-types.controller';

@Module({ controllers: [ExtinguisherTypesController] })
export class ExtinguisherTypesModule {}
