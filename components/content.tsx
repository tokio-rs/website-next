import Menu from "../components/menu";
import { DiscordIcon, GitHubIcon } from "./icons";
import React from "react";
import ReactMarkdown from "react-markdown/with-html";
import SyntaxHighlighter from "react-syntax-highlighter";
import GithubSlugger from 'github-slugger';

const CodeBlock = ({ language, value }) => {
  return (
    <SyntaxHighlighter useInlineStyles={false} language={language}>
      {value}
    </SyntaxHighlighter>
  );
};

function Heading(slugger, props) {
  let children = React.Children.toArray(props.children)
  let text = children.reduce(flatten, '')
  let slug = slugger.slug(text);
  return React.createElement('h' + props.level, {id: slug}, props.children)
}

function flatten(text, child) {
  return typeof child === 'string'
    ? text + child
    : React.Children.toArray(child.props.children).reduce(flatten, text)
}

function Footer({ next, prev }) {
  return (
    <div className="tk-doc-footer">
      <div className="level">
        <div className="level-left">
          <div className="level-item tk-prev">
            {prev && (
              <a href={prev.href}>
                <span className="tk-arrow" style={{ marginRight: "0.5rem" }}>
                  <img src="/img/arrow-left.svg" />
                </span>
                {prev.title}
              </a>
            )}
          </div>
        </div>
        <div className="level-right">
          <div className="level-item tk-next">
            {next && (
              <a href={next.href}>
                {next.title}
                <span className="tk-arrow" style={{ marginLeft: "0.5rem" }}>
                  <img src="/img/arrow-right.svg" />
                </span>
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="level">
        <div className="level-left">
          <div className="level-item tk-help-links">
            <p>
              Get Help:
              <a href="https://github.com/tokio-rs/tokio/discussions">
                <GitHubIcon className="is-medium" />
              </a>
              <a href="https://discord.gg/tokio">
                <DiscordIcon className="is-medium" />
              </a>
            </p>
          </div>
        </div>
        <div className="level-right">
          <div className="level-item tk-edit-this-page">
            <a href="#">Edit this page</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Content({ menu, href, title, next, prev, body }) {
  const slugger = new GithubSlugger();
  const HeadingRenderer = (props) => {
    return Heading(slugger, props);
  };

  return (
    <>
      <div className="columns is-marginless tk-docs">
        <div className="column is-one-quarter tk-docs-nav">
          <Menu href={href} menu={menu} />
        </div>
        <div className="column is-three-quarters tk-content">
          <section className="section content">
            <div className="columns">
              <div className="column tk-markdown">
                <h1 className="title">{title}</h1>
                <ReactMarkdown
                  escapeHtml={false}
                  source={body}
                  renderers={{ code: CodeBlock, heading: HeadingRenderer }}
                />
              </div>
              <aside className="column is-one-third tk-content-summary">
                <ul className="tk-content-summary-menu">
                  <li>
                    <a href="#">Motivation</a>
                  </li>
                  <li>
                    <a href="#">Using tokio compat</a>
                    <ul>
                      <li>
                        <a href="#">Getting Started</a>
                      </li>
                      <li>
                        <a href="#">Notes</a>
                      </li>
                      <li>
                        <a href="#">
                          hello world this is a long item that will wrap some
                          and that is OK
                        </a>
                      </li>
                    </ul>
                  </li>
                  <li>
                    <a href="#">Case Study: Vector</a>
                  </li>
                  <li>
                    <a href="#">Conclusion</a>
                  </li>
                </ul>
              </aside>
            </div>
            <Footer next={next} prev={prev} />
          </section>
        </div>
      </div>
    </>
  );
}
