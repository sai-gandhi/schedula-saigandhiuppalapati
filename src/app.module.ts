TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.get('DATABASE_URL'),
    entities: [User, DoctorProfile, PatientProfile],
    synchronize: false,
    migrations: ['dist/database/migrations/*.js'],
    ssl: { rejectUnauthorized: false },
  }),
}),