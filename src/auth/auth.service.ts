import { Injectable , UnauthorizedException} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ){}

    async signup(dto: SignupDto){
        const hashed = await bcrypt.hash(dto.password, 10);
        const user = await this.usersService.create(dto.email, hashed, dto.role);
        return {
            message: 'User created successfully', role: user.role
        };
    }

    async login(dto: LoginDto){
        const user = await this.usersService.findByEmail(dto.email);
        if(!user){
            throw new UnauthorizedException('Invalid credentials');
        }
        const match = await bcrypt.compare(dto.password, user.password);
        if(!match){
            throw new UnauthorizedException('Invalid credentials');
        }
        const payload = {sub:user.id, email:user.email, role:user.role};
        return {
            access_token: this.jwtService.sign(payload)
        };
    }
}