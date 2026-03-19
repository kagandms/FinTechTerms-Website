import {
    createRequestId,
    successResponse,
} from '@/lib/api-response';
import { isAdminUserId } from '@/lib/admin-access';
import { resolveAuthenticatedUser } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
    const requestId = createRequestId(request);
    const user = await resolveAuthenticatedUser(request);

    return successResponse(
        { isAdmin: isAdminUserId(user?.id ?? null) },
        requestId,
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        }
    );
}
