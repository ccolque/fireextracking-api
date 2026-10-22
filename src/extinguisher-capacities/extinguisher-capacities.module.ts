import { Module } from '@nestjs/common';
import { ExtinguisherCapacitiesController } from './extinguisher-capacities.controller';

@Module({ controllers: [ExtinguisherCapacitiesController] })
export class ExtinguisherCapacitiesModule {}
