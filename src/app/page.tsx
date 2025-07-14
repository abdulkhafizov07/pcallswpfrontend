import {AudioChatComponent} from "@/components/web/audio-chat";
import {Container} from "@chakra-ui/react";

export default function Home() {
  return (
    <>
      <Container marginX="auto" paddingY="6rem" h="100vh">
        <AudioChatComponent />
      </Container>
    </>
  );
}

