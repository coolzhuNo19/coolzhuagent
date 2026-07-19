mod client;
mod config;
mod embeddings;
mod error;
mod model_info;
mod providers;
mod registry;
mod resolver;
mod sse;
mod types;

pub use client::{
    oauth_token_is_expired, read_base_url, read_xai_base_url, read_zhipu_base_url,
    resolve_saved_oauth_token, resolve_startup_auth_source, MessageStream, OAuthTokenSet,
    ProviderClient,
};
pub use config::{load_config, AdapterConfig, ModelConfig, ProviderConfig};
pub use embeddings::embed_texts;
pub use error::ApiError;
pub use model_info::{
    Modality, ModelCost, ModelInfo, ModelLimit, ModelModalities, ModelStatus, ProviderInfo,
};
pub use providers::claw_provider::{AuthSource, ClawApiClient, ClawApiClient as ApiClient};
pub use providers::openai_compat::{OpenAiCompatClient, OpenAiCompatConfig};
pub use providers::{
    context_tokens_for_model, detect_provider_kind, max_tokens_for_model, model_token_limit,
    provider_catalog, provider_kind_from_name, provider_option, resolve_model_alias,
    ModelTokenLimit, ProviderKind, ProviderMetadata, ProviderOption,
};
pub use registry::{ModelRegistry, ResolvedModel};
pub use resolver::{
    AuthPolicy, EndpointResolver, ProviderProtocol, RequestCapability, ResolvedProviderRoute,
};
pub use sse::{parse_frame, SseParser};
pub use types::{
    ContentBlockDelta, ContentBlockDeltaEvent, ContentBlockStartEvent, ContentBlockStopEvent,
    InputContentBlock, InputMessage, MessageDelta, MessageDeltaEvent, MessageRequest,
    MessageResponse, MessageStartEvent, MessageStopEvent, OutputContentBlock, StreamEvent,
    ToolChoice, ToolDefinition, ToolResultContentBlock, Usage,
};

#[cfg(test)]
mod resolver_contract_tests {
    use crate::{EndpointResolver, ProviderProtocol, RequestCapability};

    #[test]
    fn resolver_deduplicates_anthropic_messages_endpoint() {
        assert_eq!(
            EndpointResolver::resolve(
                "https://api.anthropic.com/v1",
                ProviderProtocol::AnthropicMessages,
                None
            )
            .expect("anthropic endpoint should resolve"),
            "https://api.anthropic.com/v1/messages"
        );
        assert_eq!(
            EndpointResolver::resolve(
                "https://api.anthropic.com/v1/messages",
                ProviderProtocol::AnthropicMessages,
                None
            )
            .expect("full anthropic endpoint should be stable"),
            "https://api.anthropic.com/v1/messages"
        );
    }

    #[test]
    fn resolver_supports_openai_base_host_base_path_and_full_endpoint() {
        assert_eq!(
            EndpointResolver::resolve(
                "https://api.openai.example",
                ProviderProtocol::OpenAiChatCompletions,
                None
            )
            .expect("host should resolve"),
            "https://api.openai.example/v1/chat/completions"
        );
        assert_eq!(
            EndpointResolver::resolve(
                "https://api.openai.example/v1",
                ProviderProtocol::OpenAiChatCompletions,
                None
            )
            .expect("base path should resolve"),
            "https://api.openai.example/v1/chat/completions"
        );
        assert_eq!(
            EndpointResolver::resolve(
                "https://api.openai.example/v1/chat/completions",
                ProviderProtocol::OpenAiChatCompletions,
                None
            )
            .expect("full endpoint should be stable"),
            "https://api.openai.example/v1/chat/completions"
        );
    }

    #[test]
    fn resolver_deduplicates_media_endpoints_and_rejects_unsupported_capability() {
        assert_eq!(
            EndpointResolver::resolve(
                "https://api.openai.example/v1/images/generations",
                ProviderProtocol::OpenAiImagesGenerations,
                None
            )
            .expect("image endpoint should be stable"),
            "https://api.openai.example/v1/images/generations"
        );

        let error = EndpointResolver::protocol_for_capability(RequestCapability::Audio);
        assert!(error.is_err());
    }
}
