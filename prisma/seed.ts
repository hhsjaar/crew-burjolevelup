import { PrismaClient, Role, AttendanceStatus, TaskType, TaskStatus, LeaveType, LeaveStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL?.replace(/\?pgbouncer=true(&connection_limit=\d+)?/, "");

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required for seeding the database.");
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("supabase.com") ? { rejectUnauthorized: false } : false,
  options: "-c search_path=absensi",
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding (Postgres Schema absensi)...");

  // Clear existing data
  await prisma.leaveRequest.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.employee.deleteMany({});

  // Hash passwords
  const ownerPasswordHash = await bcrypt.hash("admin", 10);
  const employeePasswordHash = await bcrypt.hash("burjolevelup", 10);

  // Create Employees
  const admin = await prisma.employee.create({
    data: {
      email: "burjolevelup",
      password: ownerPasswordHash,
      name: "Owner Burjolevelup",
      role: Role.ADMIN,
      dailySalary: 250000.0, // Rp 250.000 / hari
    },
  });

  const hamam = await prisma.employee.create({
    data: {
      email: "hamam",
      password: employeePasswordHash,
      name: "Hamam",
      role: Role.EMPLOYEE,
      dailySalary: 100000.0, // Rp 100.000 / hari
    },
  });

  const yogi = await prisma.employee.create({
    data: {
      email: "yogi",
      password: employeePasswordHash,
      name: "Yogi",
      role: Role.EMPLOYEE,
      dailySalary: 100000.0,
    },
  });

  const rian = await prisma.employee.create({
    data: {
      email: "rian",
      password: employeePasswordHash,
      name: "Rian",
      role: Role.EMPLOYEE,
      dailySalary: 100000.0,
    },
  });

  console.log("Employees created: Owner burjolevelup, hamam, yogi, and rian");

  // Create attendance history for the past 5 days (excluding today)
  const today = new Date();
  const pastDays = [];
  for (let i = 5; i > 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    pastDays.push({ date: dateStr, dateObj: d });
  }

  // Seeding attendance for Hamam (Mostly ON_TIME, 1 LATE)
  for (let i = 0; i < pastDays.length; i++) {
    const day = pastDays[i];
    const isLate = i === 2; // Make one day late
    const clockInTime = new Date(day.dateObj);
    clockInTime.setHours(isLate ? 8 : 7, isLate ? 45 : 30, 0); // 07:30 (On Time) or 08:45 (Late)

    const clockOutTime = new Date(day.dateObj);
    clockOutTime.setHours(17, 0, 0); // 17:00

    await prisma.attendance.create({
      data: {
        employeeId: hamam.id,
        date: day.date,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        status: isLate ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
        notes: isLate ? "Terjebak macet di jalan layang" : "Datang lebih awal",
      },
    });
  }

  // Seeding attendance for Yogi (ON_TIME, 1 LEAVE)
  for (let i = 0; i < pastDays.length; i++) {
    const day = pastDays[i];
    if (i === 1) {
      await prisma.attendance.create({
        data: {
          employeeId: yogi.id,
          date: day.date,
          status: AttendanceStatus.LEAVE,
          notes: "Izin Sakit Gigi",
        },
      });

      await prisma.leaveRequest.create({
        data: {
          employeeId: yogi.id,
          startDate: new Date(day.dateObj),
          endDate: new Date(day.dateObj),
          type: LeaveType.SICK,
          reason: "Sakit gigi perlu periksa ke dokter gigi",
          status: LeaveStatus.APPROVED,
          adminNotes: "Lekas sembuh! Izin disetujui.",
        },
      });
    } else {
      const clockInTime = new Date(day.dateObj);
      clockInTime.setHours(7, 45, 0); // 07:45 (On Time)

      const clockOutTime = new Date(day.dateObj);
      clockOutTime.setHours(17, 15, 0); // 17:15

      await prisma.attendance.create({
        data: {
          employeeId: yogi.id,
          date: day.date,
          clockIn: clockInTime,
          clockOut: clockOutTime,
          status: AttendanceStatus.ON_TIME,
          notes: "Tepat waktu",
        },
      });
    }
  }

  console.log("Attendance history created");

  // Create Tasks (Jobdesk) for Hamam
  await prisma.task.create({
    data: {
      title: "Bersihkan Area Kasir dan Mesin Kopi",
      description: "Lap bersih area kasir, bersihkan grinder kopi, dan cuci portafilter",
      type: TaskType.DAILY,
      status: TaskStatus.IN_PROGRESS,
      employeeId: hamam.id,
      createdById: admin.id,
      dueDate: new Date(today),
    },
  });

  await prisma.task.create({
    data: {
      title: "Restock Bahan Baku Mingguan",
      description: "Menghitung persediaan susu, es batu, biji kopi, dan mengajukan pembelian ke supplier",
      type: TaskType.WEEKLY,
      status: TaskStatus.PENDING,
      employeeId: hamam.id,
      createdById: admin.id,
      dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
    },
  });

  await prisma.task.create({
    data: {
      title: "Evaluasi Laporan Penjualan Burjo",
      description: "Merekap omset penjualan bulanan warung burjo",
      type: TaskType.MONTHLY,
      status: TaskStatus.PENDING,
      employeeId: hamam.id,
      createdById: admin.id,
      dueDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), // Due in 10 days
    },
  });

  // Create Tasks (Jobdesk) for Yogi
  await prisma.task.create({
    data: {
      title: "Persiapan Bahan Indomie dan Gorengan",
      description: "Potong sawi, kupas bawang, siapkan adonan gorengan segar untuk shift sore",
      type: TaskType.DAILY,
      status: TaskStatus.COMPLETED,
      employeeId: yogi.id,
      createdById: admin.id,
      dueDate: new Date(today),
    },
  });

  await prisma.task.create({
    data: {
      title: "Deep Cleaning Dapur Warung",
      description: "Membersihkan kompor mawar, exhaust fan, lantai dapur, dan kulkas penyimpanan",
      type: TaskType.WEEKLY,
      status: TaskStatus.IN_PROGRESS,
      employeeId: yogi.id,
      createdById: admin.id,
      dueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000), // Due in 4 days
    },
  });

  // Create Tasks (Jobdesk) for Rian
  await prisma.task.create({
    data: {
      title: "Melayani Pelanggan Meja 1-10",
      description: "Pastikan pelayanan cepat, sopan, dan bersih kepada pelanggan yang dine-in",
      type: TaskType.DAILY,
      status: TaskStatus.PENDING,
      employeeId: rian.id,
      createdById: admin.id,
      dueDate: new Date(today),
    },
  });

  // Create FCFS Claimable Tasks ("Jobdesk Rebutan")
  await prisma.task.create({
    data: {
      title: "Bongkar Pasang Spanduk Promosi Depan",
      description: "Memasang spanduk baru promosi 'Paket Hemat Burjo Level Up' di pagar depan",
      type: TaskType.DAILY,
      status: TaskStatus.PENDING,
      isClaimable: true,
      createdById: admin.id,
      dueDate: new Date(today),
    },
  });

  await prisma.task.create({
    data: {
      title: "Cuci Seluruh Tabung Gas Kosong",
      description: "Mencuci bersih 5 tabung gas LPG 3kg kosong sebelum ditukar ke agen",
      type: TaskType.DAILY,
      status: TaskStatus.PENDING,
      isClaimable: true,
      createdById: admin.id,
      dueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Due tomorrow
    },
  });

  console.log("Tasks created successfully");
  console.log("Database seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
