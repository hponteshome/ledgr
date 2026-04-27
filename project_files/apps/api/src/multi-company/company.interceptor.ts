import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler, 
  BadRequestException 
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class CompanyInterceptor implements NestInterceptor {
  // Removed companyService injection to avoid undefined and concurrency errors
  constructor() {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const url = request.url;

    // 1. WHITE LIST: Routes that DO NOT require x-company-id
    // Added 'available' and 'headquarters' so you can list and choose the company
    const isPublicRoute = 
      url.includes('/auth/') || 
      url.includes('/companies/available') || 
      url.includes('/companies/headquarters');

    if (isPublicRoute) {
      return next.handle();
    }

    const companyId = request.headers['x-company-id'];

    // 2. Header Validation
    if (!companyId) {
      throw new BadRequestException('The x-company-id header is required to access this resource.');
    }

    // 3. SECURE STRATEGY: 
    // Inject companyId directly into the request object.
    // This allows Services and Controllers to read from request.user or request.companyId
    request.companyId = companyId;

    return next.handle();
  }
}