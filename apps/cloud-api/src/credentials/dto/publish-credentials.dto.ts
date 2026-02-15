import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsPositive,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StudentRecordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  rollNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  degree!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  branch!: string;

  @IsNumber()
  @IsPositive()
  @Min(1900)
  @Max(2100)
  graduationYear!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  cgpa!: number;
}

export class PublishCredentialsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  issuerCode!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentRecordDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  records!: StudentRecordDto[];
}
