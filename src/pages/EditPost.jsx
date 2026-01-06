import React, { useEffect, useState } from "react";
import appwriteService from "../appwrite/config";
import { Container, PostForm } from "../components/index";
import { useNavigate, useParams } from "react-router-dom";

export default function EditPost() {
  const [post, setPost] = useState(null);
  const navigate = useNavigate();
  const { slug } = useParams();
  useEffect(() => {
    appwriteService.getPost(slug).then((post) => {
      if (post) {
        setPost(post);
      } else {
        navigate("/");
      }
    });
  }, [slug, navigate]);
  return post ? (
    <div className="py-8">
      <Container>
        <PostForm post={post} />
      </Container>
    </div>
  ) : null;
}
