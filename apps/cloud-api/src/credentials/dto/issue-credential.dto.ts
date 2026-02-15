import { IsString, IsNumber, IsPositive, Min, Max, MinLength, MaxLength } from 'class-validator';

export class IssueCredentialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  issuerCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  rollNumber!: string;

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
