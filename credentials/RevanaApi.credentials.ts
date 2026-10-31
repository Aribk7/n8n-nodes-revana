import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RevanaApi implements ICredentialType {
	name = 'revanaApi';

	displayName = 'Revana API';

	icon: Icon = { light: 'file:revana.svg', dark: 'file:revana.svg' };

	documentationUrl = 'https://revana.si/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Create a key at https://revana.si/dashboard',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.revana.si',
			url: '/v1/balance',
			method: 'GET',
		},
	};
}
