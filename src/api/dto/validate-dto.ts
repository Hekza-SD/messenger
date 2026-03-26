import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NextFunction, Request, Response } from 'express';
import { DTO } from './dto';

import { ValidationType } from './validation-type';
import { InvalidInputError } from '../errors/invalid-input.error';

export function validateDto(
    dtoClass: new () => DTO, // Check that dtoClass is an instance of class that extends DTO
    source: ValidationType = ValidationType.BODY,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req, res, next) => {
        const dtoInstance = plainToInstance(dtoClass, req[source]);
        const errors = await validate(dtoInstance);

        if (errors.length > 0) {
            const errorsList = errors.map((error) => {
                return { property: error.property, constraints: error.constraints };
            });
            next(new InvalidInputError(source, errorsList));
            return;
        }

        next();
    };
}
