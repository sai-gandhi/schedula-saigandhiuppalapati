export enum Role{
    DOCTOR = 'DOCTOR',
    PATIENT = 'PATIENT',
}

export interface User {
    id: number;
    email: string;
    password: string;
    role: Role;
}