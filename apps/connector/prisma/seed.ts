import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const STUDENTS = [
  // QA Test Student (deterministic, used by QA checklist)
  { issuerCode: 'CVR', rollNumber: 'QA-TEST-001', name: 'QA Test Student', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 8.5 },
  // Realistic CVR College of Engineering students
  { issuerCode: 'CVR', rollNumber: '21B81A0501', name: 'Supreeth Chaluvadi', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 8.75 },
  { issuerCode: 'CVR', rollNumber: '21B81A0502', name: 'Ananya Reddy', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 9.12 },
  { issuerCode: 'CVR', rollNumber: '21B81A0403', name: 'Rahul Sharma', degree: 'B.Tech', branch: 'Electronics', graduationYear: 2025, cgpa: 7.88 },
  { issuerCode: 'CVR', rollNumber: '21B81A0504', name: 'Priya Nair', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 9.45 },
  { issuerCode: 'CVR', rollNumber: '21B81A0305', name: 'Karthik Menon', degree: 'B.Tech', branch: 'Mechanical', graduationYear: 2025, cgpa: 7.32 },
  { issuerCode: 'CVR', rollNumber: '21B81A0506', name: 'Deepika Joshi', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 8.91 },
  { issuerCode: 'CVR', rollNumber: '21B81A0207', name: 'Arjun Patel', degree: 'B.Tech', branch: 'Civil', graduationYear: 2025, cgpa: 7.65 },
  { issuerCode: 'CVR', rollNumber: '21B81A0508', name: 'Sneha Kulkarni', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 8.34 },
  { issuerCode: 'CVR', rollNumber: '21B81A0409', name: 'Vikram Singh', degree: 'B.Tech', branch: 'Electronics', graduationYear: 2025, cgpa: 8.02 },
  { issuerCode: 'CVR', rollNumber: '21B81A0510', name: 'Meera Iyer', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 9.67 },
  // Additional students for realistic density
  { issuerCode: 'CVR', rollNumber: '21B81A0511', name: 'Aditya Kumar', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 8.15 },
  { issuerCode: 'CVR', rollNumber: '21B81A0312', name: 'Sanjana Rao', degree: 'B.Tech', branch: 'Mechanical', graduationYear: 2025, cgpa: 7.90 },
  { issuerCode: 'CVR', rollNumber: '21B81A0413', name: 'Nikhil Verma', degree: 'B.Tech', branch: 'Electronics', graduationYear: 2025, cgpa: 8.44 },
  { issuerCode: 'CVR', rollNumber: '21B81A0514', name: 'Ishita Gupta', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 9.01 },
  { issuerCode: 'CVR', rollNumber: '21B81A0215', name: 'Rohan Deshmukh', degree: 'B.Tech', branch: 'Civil', graduationYear: 2025, cgpa: 7.55 },
  { issuerCode: 'CVR', rollNumber: '21B81A0516', name: 'Kavya Krishnan', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 8.88 },
  { issuerCode: 'CVR', rollNumber: '21B81A0317', name: 'Varun Reddy', degree: 'B.Tech', branch: 'Mechanical', graduationYear: 2025, cgpa: 7.20 },
  { issuerCode: 'CVR', rollNumber: '21B81A0518', name: 'Tanvi Sharma', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 9.33 },
  { issuerCode: 'CVR', rollNumber: '21B81A0419', name: 'Harsh Patel', degree: 'B.Tech', branch: 'Electronics', graduationYear: 2025, cgpa: 7.78 },
  { issuerCode: 'CVR', rollNumber: '21B81A0520', name: 'Divya Nair', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 8.60 },
  // 2024 batch (older graduates)
  { issuerCode: 'CVR', rollNumber: '20B81A0501', name: 'Ravi Teja', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2024, cgpa: 8.42 },
  { issuerCode: 'CVR', rollNumber: '20B81A0502', name: 'Lakshmi Prasad', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2024, cgpa: 9.10 },
  { issuerCode: 'CVR', rollNumber: '20B81A0303', name: 'Ajay Kapoor', degree: 'B.Tech', branch: 'Mechanical', graduationYear: 2024, cgpa: 7.95 },
  // M.Tech students
  { issuerCode: 'CVR', rollNumber: '22M81A0501', name: 'Siddharth Rao', degree: 'M.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 8.80 },
  { issuerCode: 'CVR', rollNumber: '22M81A0502', name: 'Neha Agarwal', degree: 'M.Tech', branch: 'Computer Science', graduationYear: 2025, cgpa: 9.25 },
];

async function main() {
  console.log('Seeding ERP database with Test College student records...');

  for (const student of STUDENTS) {
    await prisma.erpStudent.upsert({
      where: {
        issuerCode_rollNumber: {
          issuerCode: student.issuerCode,
          rollNumber: student.rollNumber,
        },
      },
      update: {
        name: student.name,
        degree: student.degree,
        branch: student.branch,
        graduationYear: student.graduationYear,
        cgpa: student.cgpa,
      },
      create: student,
    });
  }

  const count = await prisma.erpStudent.count();
  console.log(`Seeded ${count} student records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
