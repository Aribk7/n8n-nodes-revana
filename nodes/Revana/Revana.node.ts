import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

const API = 'https://api.revana.si';

interface RevanaModel {
	id: string;
	name?: string;
	kind: string;
	maker?: string;
	price?: { unit?: string; usd?: number | Record<string, number> };
}

async function revanaRequest(
	ctx: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	extra: Partial<IHttpRequestOptions> = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${API}${path}`,
		json: true,
		...extra,
	};
	if (body) options.body = body;
	return (await ctx.helpers.httpRequestWithAuthentication.call(
		ctx,
		'revanaApi',
		options,
	)) as IDataObject;
}

async function loadModels(ctx: ILoadOptionsFunctions, kinds: string[]): Promise<INodePropertyOptions[]> {
	const res = (await ctx.helpers.httpRequest({ method: 'GET', url: `${API}/v1/models`, json: true })) as {
		data: RevanaModel[];
	};
	return res.data
		.filter((m) => kinds.includes(m.kind))
		.map((m) => ({
			name: `${m.name ?? m.id} (${m.kind})`,
			value: m.id,
			description: m.maker ? `By ${m.maker}` : undefined,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export class Revana implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Revana',
		name: 'revana',
		icon: { light: 'file:revana.svg', dark: 'file:revana.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Generate AI video, images and music (Seedance, Veo, Kling, Nano Banana, GPT Image and 200+ models) and chat with LLMs through one Revana API key',
		defaults: {
			name: 'Revana',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'revanaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Generate Media',
						value: 'generate',
						description: 'Create a video, image or music generation and optionally wait for the file',
						action: 'Generate media',
					},
					{
						name: 'Get Generation',
						value: 'getGeneration',
						description: 'Get the status and output of a generation',
						action: 'Get a generation',
					},
					{
						name: 'List Models',
						value: 'listModels',
						description: 'List available models with live prices',
						action: 'List models',
					},
					{
						name: 'Chat',
						value: 'chat',
						description: 'Send a message to a text model (OpenAI-compatible chat completions)',
						action: 'Chat with a text model',
					},
				],
				default: 'generate',
			},

			// ----- generate -----
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getMediaModels' },
				default: '',
				required: true,
				description:
					'Model to run, e.g. seedance-2.5, veo-3.1-fast, kling-3.0, nano-banana-pro, minimax-h3-free. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { operation: ['generate'] } },
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['generate'] } },
			},
			{
				displayName: 'Wait for Result',
				name: 'waitForResult',
				type: 'boolean',
				default: true,
				description: 'Whether to poll until the generation finishes. Videos usually take 30 s to a few minutes.',
				displayOptions: { show: { operation: ['generate'] } },
			},
			{
				displayName: 'Download File',
				name: 'download',
				type: 'boolean',
				default: true,
				description: 'Whether to attach the generated file as binary data',
				displayOptions: { show: { operation: ['generate'], waitForResult: [true] } },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { operation: ['generate'] } },
				options: [
					{
						displayName: 'Aspect Ratio',
						name: 'aspect_ratio',
						type: 'string',
						default: '',
						placeholder: '16:9',
					},
					{
						displayName: 'Audio',
						name: 'audio',
						type: 'boolean',
						default: false,
						description: 'Whether to generate sound (video models that support it)',
					},
					{
						displayName: 'Duration (Seconds)',
						name: 'duration',
						type: 'number',
						default: 5,
					},
					{
						displayName: 'Extra Input (JSON)',
						name: 'extraInput',
						type: 'json',
						default: '{}',
						description: 'Any other model input fields, merged into the request input',
					},
					{
						displayName: 'Image URL',
						name: 'image_url',
						type: 'string',
						default: '',
						description: 'Public link to a first frame or reference image',
					},
					{
						displayName: 'Max Cost (USD)',
						name: 'max_cost_usd',
						type: 'number',
						typeOptions: { numberPrecision: 2 },
						default: 0,
						description: 'Most this generation may cost; routes above it are skipped. 0 means no cap.',
					},
					{
						displayName: 'Max Wait (Seconds)',
						name: 'maxWait',
						type: 'number',
						default: 900,
						description: 'How long to poll before giving up (the generation keeps running)',
					},
					{
						displayName: 'Resolution',
						name: 'resolution',
						type: 'string',
						default: '',
						placeholder: '720p',
					},
				],
			},

			// ----- getGeneration -----
			{
				displayName: 'Generation ID',
				name: 'generationId',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'gen_3f9a1c0d2b7e4a5f6c81',
				displayOptions: { show: { operation: ['getGeneration'] } },
			},

			// ----- listModels -----
			{
				displayName: 'Kind',
				name: 'kind',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Audio', value: 'audio' },
					{ name: 'Image', value: 'image' },
					{ name: 'Text', value: 'text' },
					{ name: 'Video', value: 'video' },
				],
				default: 'all',
				displayOptions: { show: { operation: ['listModels'] } },
			},

			// ----- chat -----
			{
				displayName: 'Model Name or ID',
				name: 'chatModel',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getTextModels' },
				default: '',
				required: true,
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				displayOptions: { show: { operation: ['chat'] } },
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['chat'] } },
			},
			{
				displayName: 'System Prompt',
				name: 'system',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				displayOptions: { show: { operation: ['chat'] } },
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				default: 1024,
				displayOptions: { show: { operation: ['chat'] } },
			},
		],
	};

	methods = {
		loadOptions: {
			async getMediaModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await loadModels(this, ['video', 'image', 'audio']);
			},
			async getTextModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await loadModels(this, ['text']);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'listModels') {
					const kind = this.getNodeParameter('kind', i) as string;
					const res = (await this.helpers.httpRequest({
						method: 'GET',
						url: `${API}/v1/models`,
						json: true,
					})) as { data: IDataObject[] };
					for (const m of res.data) {
						if (kind === 'all' || m.kind === kind) out.push({ json: m, pairedItem: i });
					}
					continue;
				}

				if (operation === 'getGeneration') {
					const id = this.getNodeParameter('generationId', i) as string;
					const gen = await revanaRequest(this, 'GET', `/v1/generations/${encodeURIComponent(id)}`);
					out.push({ json: gen, pairedItem: i });
					continue;
				}

				if (operation === 'chat') {
					const model = this.getNodeParameter('chatModel', i) as string;
					const message = this.getNodeParameter('message', i) as string;
					const system = this.getNodeParameter('system', i, '') as string;
					const maxTokens = this.getNodeParameter('maxTokens', i) as number;
					const messages: IDataObject[] = [];
					if (system) messages.push({ role: 'system', content: system });
					messages.push({ role: 'user', content: message });
					const res = await revanaRequest(this, 'POST', '/v1/chat/completions', {
						model,
						messages,
						max_tokens: maxTokens,
					});
					const choices = (res.choices as IDataObject[]) ?? [];
					const first = (choices[0]?.message as IDataObject) ?? {};
					out.push({
						json: { text: first.content ?? '', model: res.model, usage: res.usage, id: res.id },
						pairedItem: i,
					});
					continue;
				}

				// generate
				const model = this.getNodeParameter('model', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const waitForResult = this.getNodeParameter('waitForResult', i) as boolean;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;

				const input: IDataObject = { prompt };
				for (const key of ['resolution', 'aspect_ratio', 'image_url'] as const) {
					if (options[key]) input[key] = options[key];
				}
				if (options.duration !== undefined) input.duration = options.duration;
				if (options.audio !== undefined) input.audio = options.audio;
				if (options.extraInput) {
					const extra =
						typeof options.extraInput === 'string'
							? (JSON.parse(options.extraInput) as IDataObject)
							: (options.extraInput as IDataObject);
					Object.assign(input, extra);
				}

				const body: IDataObject = { model, input };
				const maxCost = options.max_cost_usd as number | undefined;
				if (maxCost && maxCost > 0) body.max_cost_usd = maxCost;

				let gen = await revanaRequest(this, 'POST', '/v1/generations', body, {
					headers: { 'Idempotency-Key': `n8n-${this.getExecutionId()}-${this.getNode().id}-${i}` },
				});

				if (!waitForResult) {
					out.push({ json: gen, pairedItem: i });
					continue;
				}

				const maxWait = ((options.maxWait as number) ?? 900) * 1000;
				const started = Date.now();
				while (gen.status !== 'succeeded') {
					if (gen.status === 'failed') {
						const err = (gen.error as IDataObject) ?? {};
						throw new NodeOperationError(
							this.getNode(),
							`Generation ${gen.id} failed: ${err.code ?? 'error'}: ${err.message ?? ''} (not charged)`,
							{ itemIndex: i },
						);
					}
					if (Date.now() - started > maxWait) {
						throw new NodeOperationError(
							this.getNode(),
							`Generation ${gen.id} still ${gen.status} after ${Math.round(maxWait / 1000)} s. Use Get Generation later.`,
							{ itemIndex: i },
						);
					}
					await sleep(4000);
					gen = await revanaRequest(this, 'GET', `/v1/generations/${gen.id}`);
				}

				const result: INodeExecutionData = { json: gen, pairedItem: i };
				const download = this.getNodeParameter('download', i, true) as boolean;
				if (download) {
					const urls = ((gen.output as IDataObject)?.urls as string[]) ?? [
						`${API}/v1/generations/${gen.id}/content`,
					];
					result.binary = {};
					for (let n = 0; n < urls.length; n++) {
						// /content answers with a redirect to a signed storage link; send the key only to api.revana.si.
						const hop = (await this.helpers.httpRequestWithAuthentication.call(this, 'revanaApi', {
							method: 'GET',
							url: urls[n],
							disableFollowRedirect: true,
							ignoreHttpStatusErrors: true,
							returnFullResponse: true,
							encoding: 'arraybuffer',
						})) as { body: ArrayBuffer; headers: IDataObject; statusCode: number };
						const location = hop.headers.location as string | undefined;
						const file =
							hop.statusCode >= 300 && hop.statusCode < 400 && location
								? ((await this.helpers.httpRequest({
										method: 'GET',
										url: location,
										encoding: 'arraybuffer',
										returnFullResponse: true,
									})) as { body: ArrayBuffer; headers: IDataObject })
								: hop;
						const mime = String(file.headers['content-type'] ?? 'application/octet-stream').split(';')[0];
						const ext = mime.split('/')[1]?.replace('mpeg', 'mp3') ?? 'bin';
						result.binary[n === 0 ? 'data' : `data${n + 1}`] = await this.helpers.prepareBinaryData(
							Buffer.from(file.body),
							`${gen.id}${n ? `-${n + 1}` : ''}.${ext}`,
							mime,
						);
					}
				}
				out.push(result);
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [out];
	}
}
