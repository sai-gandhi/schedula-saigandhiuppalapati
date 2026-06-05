import { Injectable, ConflictException } from '@nestjs/common';
import {User, Role} from './user.entity';
@Injectable()
export class UsersService {
    private users: User[] = [];
    private idCounter = 1;

    async findByEmail(email: string): Promise<User | undefined> {
        return this.users.find(u => u.email === email);
    }

    async create(email: string, password: string, role: Role): Promise<User> {
        const existing = await this.findByEmail(email);
        if (existing) {
            throw new ConflictException('User with this email already exists');
        }
        const user: User = {
            id: this.idCounter++,
            email,
            password,
            role
        };
        this.users.push(user);
        return user;
    }
}
